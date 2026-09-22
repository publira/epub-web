package main

import (
	"bytes"
	"cmp"
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"slices"
	"strconv"
	"strings"
)

// pageHeadMarker marks where an HTML page receives the head elements that
// depend on the request: its canonical link, the Open Graph locale
// alternates, and the hreflang links.
const pageHeadMarker = "<!-- epub-web:head -->"

// pageMessageIDs are the messages an HTML page carries in the fallback
// language, which renderLocalizedPage replaces with the requested language.
var pageMessageIDs = []string{"document.title", "document.description", "document.ogLocale"}

// matchInterfaceLocale maps a tag such as "ja-JP" to an interface locale by
// its primary language subtag.
func matchInterfaceLocale(tag string) (interfaceLocale, bool) {
	primary, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(tag)), "-")
	primary, _, _ = strings.Cut(primary, "_")
	for _, locale := range interfaceLocales {
		if locale.lang == primary {
			return locale, true
		}
	}

	return interfaceLocale{}, false
}

// matchAcceptLanguage returns the interface locale with the highest q-value
// in an Accept-Language header.
func matchAcceptLanguage(header string) (interfaceLocale, bool) {
	type weightedTag struct {
		tag string
		q   float64
	}

	var tags []weightedTag
	for entry := range strings.SplitSeq(header, ",") {
		tag, params, _ := strings.Cut(strings.TrimSpace(entry), ";")
		q := 1.0
		if value, ok := strings.CutPrefix(strings.TrimSpace(params), "q="); ok {
			parsed, err := strconv.ParseFloat(value, 64)
			if err != nil {
				continue
			}
			q = parsed
		}
		if tag != "" && q > 0 {
			tags = append(tags, weightedTag{tag: tag, q: q})
		}
	}
	slices.SortStableFunc(tags, func(a, b weightedTag) int { return cmp.Compare(b.q, a.q) })

	for _, weighted := range tags {
		if locale, ok := matchInterfaceLocale(weighted.tag); ok {
			return locale, true
		}
	}

	return interfaceLocale{}, false
}

// resolveRequestLocale picks the initial interface language of a page
// request: ?lang=, then Accept-Language, then the fallback. fromQuery reports
// that ?lang= named it. The SPA may then switch to a language the visitor
// stored in the browser.
func resolveRequestLocale(r *http.Request) (locale interfaceLocale, fromQuery bool) {
	if locale, ok := matchInterfaceLocale(r.URL.Query().Get("lang")); ok {
		return locale, true
	}
	if locale, ok := matchAcceptLanguage(r.Header.Get("Accept-Language")); ok {
		return locale, false
	}

	return interfaceLocales[0], false
}

// renderLocalizedPage rewrites the fallback-language <html lang> and page
// messages into current, and fills the head marker with the canonical link,
// the Open Graph locale alternates, and the hreflang alternates of pageURL.
// explicit marks a request that named its language with ?lang=, which is then
// part of the canonical URL.
func renderLocalizedPage(page []byte, pageURL string, current interfaceLocale, explicit bool) []byte {
	canonical := pageURL
	if explicit {
		canonical += "?lang=" + current.lang
	}

	var head strings.Builder
	fmt.Fprintf(&head, `<link href="%s" rel="canonical" />`+"\n    ", html.EscapeString(canonical))
	for _, locale := range interfaceLocales {
		if locale.lang != current.lang {
			fmt.Fprintf(&head, `<meta content="%s" property="og:locale:alternate" />`+"\n    ",
				html.EscapeString(locale.message("document.ogLocale")))
		}
	}
	for _, locale := range interfaceLocales {
		fmt.Fprintf(&head, `<link href="%s" hreflang="%s" rel="alternate" />`+"\n    ",
			html.EscapeString(pageURL+"?lang="+locale.lang), locale.lang)
	}
	// Without ?lang= the language comes from the browser.
	fmt.Fprintf(&head, `<link href="%s" hreflang="x-default" rel="alternate" />`,
		html.EscapeString(pageURL))

	// Localize the fallback messages before the marker receives the other
	// languages' values.
	rendered := page
	if current.lang != fallbackLanguage {
		fallback := interfaceLocales[0]
		rendered = bytes.Replace(rendered,
			[]byte(`<html lang="`+fallback.lang+`">`),
			[]byte(`<html lang="`+current.lang+`">`), 1)
		for _, id := range pageMessageIDs {
			rendered = bytes.ReplaceAll(rendered,
				[]byte(html.EscapeString(fallback.message(id))),
				[]byte(html.EscapeString(current.message(id))))
		}
	}

	return bytes.Replace(rendered, []byte(pageHeadMarker), []byte(head.String()), 1)
}

// handleLocalizedPage serves the HTML file name from frontend at pagePath in
// the language of the request. publicURL may be empty, which leaves the
// alternates root-relative.
func handleLocalizedPage(frontend fs.FS, name, pagePath, publicURL string) http.Handler {
	page, err := fs.ReadFile(frontend, name)
	if err != nil {
		panic(err)
	}
	pageURL := publicURL + pagePath

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		locale, explicit := resolveRequestLocale(r)

		// Without ?lang= the language comes from Accept-Language.
		w.Header().Set("Vary", "Accept-Language")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(renderLocalizedPage(page, pageURL, locale, explicit))
	})
}
