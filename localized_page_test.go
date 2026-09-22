package main

import (
	"html"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testPage = `<html lang="en">
  <head>
    <meta content="EPUB Web | Image and EPUB converter" property="og:title" />
    <meta content="en_US" property="og:locale" />
    <!-- epub-web:head -->
    <title>EPUB Web | Image and EPUB converter</title>
  </head>
</html>`

func mustInterfaceLocale(t *testing.T, lang string) interfaceLocale {
	t.Helper()

	locale, ok := matchInterfaceLocale(lang)
	if !ok {
		t.Fatalf("unknown interface locale %q", lang)
	}

	return locale
}

func TestResolveRequestLocale(t *testing.T) {
	cases := []struct {
		name           string
		target         string
		acceptLanguage string
		want           string
	}{
		{name: "fallback", target: "/", want: "en"},
		{name: "accept-language", target: "/", acceptLanguage: "fr-FR, ja-JP;q=0.8, en;q=0.5", want: "ja"},
		{name: "accept-language q order", target: "/", acceptLanguage: "en;q=0.2, ja;q=0.9", want: "ja"},
		{name: "accept-language q zero", target: "/", acceptLanguage: "ja;q=0, fr", want: "en"},
		{name: "query over accept-language", target: "/?lang=en", acceptLanguage: "ja", want: "en"},
		{name: "unsupported query", target: "/?lang=fr", acceptLanguage: "ja", want: "ja"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.target, nil)
			if tc.acceptLanguage != "" {
				req.Header.Set("Accept-Language", tc.acceptLanguage)
			}

			wantFromQuery := strings.Contains(tc.target, "lang="+tc.want)
			got, fromQuery := resolveRequestLocale(req)
			if got.lang != tc.want || fromQuery != wantFromQuery {
				t.Fatalf("expected (%q, %v), got (%q, %v)", tc.want, wantFromQuery, got.lang, fromQuery)
			}
		})
	}
}

func TestRenderLocalizedPage_RootRelativeWithoutPublicURL(t *testing.T) {
	got := string(renderLocalizedPage([]byte(testPage), "/", mustInterfaceLocale(t, "en"), false))

	for _, want := range []string{
		`<html lang="en">`,
		`<title>EPUB Web | Image and EPUB converter</title>`,
		`<meta content="EPUB Web | Image and EPUB converter" property="og:title" />`,
		`<meta content="en_US" property="og:locale" />`,
		`<meta content="ja_JP" property="og:locale:alternate" />`,
		`<link href="/?lang=en" hreflang="en" rel="alternate" />`,
		`<link href="/?lang=ja" hreflang="ja" rel="alternate" />`,
		`<link href="/" hreflang="x-default" rel="alternate" />`,
		`<link href="/" rel="canonical" />`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("expected %q in:\n%s", want, got)
		}
	}
	if strings.Contains(got, pageHeadMarker) {
		t.Errorf("expected the marker to be replaced:\n%s", got)
	}
}

func TestRenderLocalizedPage_Japanese(t *testing.T) {
	got := string(renderLocalizedPage([]byte(testPage), "/", mustInterfaceLocale(t, "ja"), true))

	for _, want := range []string{
		`<html lang="ja">`,
		`<title>EPUB Web | 画像・EPUB変換</title>`,
		`<meta content="EPUB Web | 画像・EPUB変換" property="og:title" />`,
		`<meta content="ja_JP" property="og:locale" />`,
		`<meta content="en_US" property="og:locale:alternate" />`,
		`<link href="/?lang=ja" rel="canonical" />`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("expected %q in:\n%s", want, got)
		}
	}
}

func TestRenderLocalizedPage_UsesThePageURL(t *testing.T) {
	got := string(renderLocalizedPage([]byte(testPage), "https://epub.example.com/help", mustInterfaceLocale(t, "en"), true))

	for _, want := range []string{
		`<link href="https://epub.example.com/help?lang=ja" hreflang="ja" rel="alternate" />`,
		`<link href="https://epub.example.com/help" hreflang="x-default" rel="alternate" />`,
		`<link href="https://epub.example.com/help?lang=en" rel="canonical" />`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("expected %q in:\n%s", want, got)
		}
	}
}

func TestHandleLocalizedPage_RendersQueryLanguage(t *testing.T) {
	h := handleLocalizedPage(getFrontendSubFS(), "index.html", "/", "https://epub.example.com")
	req := httptest.NewRequest(http.MethodGet, "/?mode=extract&lang=ja", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{
		`<html lang="ja">`,
		`<link href="https://epub.example.com/" hreflang="x-default" rel="alternate" />`,
		`<link href="https://epub.example.com/?lang=ja" rel="canonical" />`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("expected %q in the embedded index.html", want)
		}
	}
	if len(rec.Result().Cookies()) != 0 {
		t.Fatal("expected no cookie")
	}
}

func TestHandleLocalizedPage_VariesOnAcceptLanguage(t *testing.T) {
	h := withCache(handleLocalizedPage(getFrontendSubFS(), "index.html", "/", ""))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Language", "ja")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=60" {
		t.Fatalf("expected Cache-Control %q, got %q", "public, max-age=60", got)
	}
	if got := rec.Header().Get("Vary"); got != "Accept-Language" {
		t.Fatalf("expected Vary %q, got %q", "Accept-Language", got)
	}
	if !strings.Contains(rec.Body.String(), `<html lang="ja">`) {
		t.Fatal("expected the Accept-Language locale in <html lang>")
	}
}

func TestEmbeddedIndex_CarriesTheFallbackPageMessages(t *testing.T) {
	page, err := fs.ReadFile(getFrontendSubFS(), "index.html")
	if err != nil {
		t.Fatal(err)
	}

	for _, want := range []string{`<html lang="` + fallbackLanguage + `">`, pageHeadMarker} {
		if !strings.Contains(string(page), want) {
			t.Errorf("expected %q in index.html", want)
		}
	}
	for _, id := range pageMessageIDs {
		if value := html.EscapeString(interfaceLocales[0].message(id)); !strings.Contains(string(page), value) {
			t.Errorf("expected the %s value of %q in index.html so it can be localized", fallbackLanguage, id)
		}
	}
}
