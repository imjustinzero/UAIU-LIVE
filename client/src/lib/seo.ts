import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;
  jsonLd?: object;
}

const BASE_URL = "https://uaiu.live";
const OG_IMAGE = `${BASE_URL}/uaiu-og-image.png`;

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id: string, data: object) {
  let el = document.querySelector(`script[data-seo-id="${id}"]`);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-seo-id", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSEO({ title, description, path, ogType = "website", jsonLd }: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} — UAIU.LIVE`;
    const canonicalUrl = `${BASE_URL}${path}`;

    document.title = fullTitle;

    setMeta("description", description);
    setLink("canonical", canonicalUrl);

    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:image", OG_IMAGE, "property");
    setMeta("og:site_name", "UAIU.LIVE", "property");

    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", OG_IMAGE);

    if (jsonLd) {
      setJsonLd(path, jsonLd);
    }
  }, [title, description, path, ogType, jsonLd]);
}
