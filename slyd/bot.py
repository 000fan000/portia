"""
Bot resource

Defines bot/fetch endpoint, e.g.:
    curl -d '{"request": {"url": "http://scrapinghub.com/"}}' http://localhost:9001/bot/fetch

The "request" is an object whose fields match the parameters of a Scrapy
request:
    http://doc.scrapy.org/en/latest/topics/request-response.html#scrapy.http.Request

Returns a json object. If there is an "error" field, that holds the request
error to display. Otherwise you will find the following fields:
    * page -- the retrieved page - will be annotated in future

"""
import json, errno
from functools import partial
from twisted.web.resource import Resource
from twisted.web.server import NOT_DONE_YET
from scrapy.http import Request
from scrapy.spider import BaseSpider
from scrapy import signals, log
from scrapy.crawler import Crawler
from scrapy.http import HtmlResponse
from scrapy.exceptions import DontCloseSpider
from slybot.utils import htmlpage_from_response
from slybot.spider import IblSpider
from .descriptify import descriptify

def create_bot_resource(settings, spec_manager):
    bot = Bot(settings, spec_manager)
    bot.putChild('fetch', Fetch(bot))
    return bot


class Bot(Resource):
    spider = BaseSpider('slyd')

    def __init__(self, settings, spec_manager):
        # twisted base class is old-style so we cannot user super()
        Resource.__init__(self)
        self.spec_manager = spec_manager
        # initialize scrapy crawler
        crawler = Crawler(settings)
        crawler.configure()
        crawler.signals.connect(self.keep_spider_alive, signals.spider_idle)
        crawler.crawl(self.spider)
        crawler.start()

        self.crawler = crawler
        log.msg("bot initialized", level=log.DEBUG)

    def keep_spider_alive(self, spider):
        raise DontCloseSpider("keeping it open")


class BotResource(Resource):
    def __init__(self, bot):
        Resource.__init__(self)
        self.bot = bot


class Fetch(BotResource):
    isLeaf=True

    def render_POST(self, request):
        #TODO: validate input data, handle errors, etc.
        params = read_json(request)
        scrapy_request_kwargs = params['request']
        scrapy_request_kwargs.update(
            callback=self.fetch_callback,
            errback=partial(self.fetch_errback, request),
            dont_filter=True,  # TODO: disable duplicate middleware
            meta=dict(
                handle_httpstatus_all=True,
                twisted_request=request,
                slyd_request_params=params
            )
        )
        request = Request(**scrapy_request_kwargs)
        self.bot.crawler.engine.schedule(request, self.bot.spider)
        return NOT_DONE_YET

    def fetch_callback(self, response):
        request = response.meta['twisted_request']
        if response.status != 200:
            finish_request(request, error="Received http %s" % response.status)
        if not isinstance(response, HtmlResponse):
            msg = "Non-html response: %s" % response.headers.get(
                'content-type', 'no content type')
            finish_request(request, error=msg)
        try:
            params = response.meta['slyd_request_params']
            htmlpage = htmlpage_from_response(response)
            cleaned_html = descriptify(htmlpage)
            result = dict(page=cleaned_html)
            spider = self.create_spider(request.project, params)
            if spider is not None:
                items, _link_regions = spider.extract_items(htmlpage)
                result['items'] = [i._values for i in items]
            finish_request(request, **result)
        except Exception as ex:
            log.err()
            finish_request(request, error="unexpected internal error: %s" % ex)

    def create_spider(self, project, params, **kwargs):
        spider = params['spider']
        pspec = self.bot.spec_manager.project_spec(project)
        try:
            spider_spec = pspec.spider_spec(spider).load()
            items = pspec.resource_spec('items').load()
            extractors = pspec.resource_spec('extractors').load()
            return IblSpider(spider, spider_spec, items, extractors,
                **kwargs)
        except IOError as ex:
            if ex.errno == errno.ENOENT:
                log.msg("skipping extraction, no spec: %s" % ex.filename)
            else:
                raise


    def fetch_errback(self, twisted_request, failure):
        msg = "unexpected error response: %s" % failure
        log.msg(msg, level=log.ERROR)
        finish_request(twisted_request, error=msg)


def read_json(request):
    data = request.content.getvalue()
    return json.loads(data)


def finish_request(trequest, **resp_obj):
    jdata = json.dumps(resp_obj)
    trequest.setHeader('Content-Type', 'application/json')
    trequest.setHeader('Content-Length', len(jdata))
    trequest.write(jdata)
    trequest.finish()
