import { DOMParser, Element, HTMLDocument, Node } from 'https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm.ts';
import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';

const DOM_PARSER = new DOMParser();

export async function replyMediaContent(ctx: Context, link: string | undefined) {
  if (!link?.includes('instagram.com/reel') && !link?.includes('instagram.com/p')) {
    ctx.reply('Por favor me envie um link de foto ou reel do instagram',
      { reply_to_message_id: ctx.message?.message_id });
    return;
  }
  const imgsedDom: HTMLDocument = await convertTelegramLink(link);
  const mediaWrap: Element = imgsedDom.querySelector('.media-wrap')!;
  if (!mediaWrap) {
    console.error(
      imgsedDom.textContent
    );
    throw Error('layout alterado, contatar administrador @lucasliet')
  }

  const description: string | undefined = imgsedDom.querySelector('.desc')?.textContent;
  const videoLink: string | null = mediaWrap.getAttribute('data-video');

  if (videoLink) {
    replyVideo(ctx, videoLink, description);
  } else {
    replyImage(ctx, imgsedDom, description);
  }
}

async function convertTelegramLink(url: string): Promise<HTMLDocument> {
  const mediaId = url.split('instagram.com')[1].split('/')[2];
  const response= 
    await fetch(`https://imgsed.com/p/${mediaId}`, { headers: FAKE_HEADERS}).then((res) => res.text());

  if (!response) throw Error('servidor fora do ar, tente novamente mais tarde')

  return DOM_PARSER.parseFromString(response, 'text/html')!
}

function replyVideo(ctx: Context, url: string, caption: string | undefined) {
  ctx.replyWithVideo(url,
    { reply_to_message_id: ctx.message?.message_id, caption });
}

function replyImage(ctx: Context, dom: HTMLDocument, caption: string | undefined) {
  const slideWrapper = dom.querySelector('.swiper-wrapper');
  if (slideWrapper) {
    const imageLinks: string[] =
      Array.from(slideWrapper.querySelectorAll('.swiper-slide'))
        .map((element: Node) => (element as Element))
        .map((element: Element) => element.getAttribute('data-src')!)

    ctx.replyWithMediaGroup(
      imageLinks.map((link) => InputMediaBuilder.photo(link, { caption })),
      { reply_to_message_id: ctx.message?.message_id }
    );
    return;
  }

  const imageLink =
    dom.querySelector('.media-wrap')!
      .querySelector('img')!
      .getAttribute('src')!;

  ctx.replyWithPhoto(
    imageLink,
    { reply_to_message_id: ctx.message?.message_id, caption }
  );

}

const FAKE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:98.0) Gecko/20100101 Firefox/98.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
}
fetch('http://httpbin.org/headers', { headers: FAKE_HEADERS })
  .then(async res => console.log(await res.text()))