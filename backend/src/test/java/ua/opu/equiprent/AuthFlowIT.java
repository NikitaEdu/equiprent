package ua.opu.equiprent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import ua.opu.equiprent.support.IntegrationTestBase;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Справжній HTTP-сервер на випадковому порту та клієнт із «браузерним» сховищем cookie:
 * перевіряє повний ланцюжок CSRF-cookie → заголовок → сесія, як його виконує SPA.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthFlowIT extends IntegrationTestBase {

    @LocalServerPort
    int port;

    @Test
    @DisplayName("TC-AUTH-01: реєстрація → вхід із CSRF-cookie → сесія → /me → вихід; роль із запиту ігнорується")
    void realBrowserLikeFlow() throws Exception {
        CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();
        String base = "http://localhost:" + port;

        HttpResponse<String> csrf = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/csrf")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(csrf.statusCode()).isEqualTo(200);
        assertThat(csrf.body()).contains("X-XSRF-TOKEN");
        String token = xsrf(cookies);
        assertThat(token).isNotBlank();

        // Без заголовка CSRF змінний запит відхиляється навіть за наявності cookie
        HttpResponse<String> noHeader = http.send(json(base + "/api/auth/login", null,
                "{\"email\":\"x@test.ua\",\"password\":\"whatever-long-pass\"}"), HttpResponse.BodyHandlers.ofString());
        assertThat(noHeader.statusCode()).isEqualTo(403);

        HttpResponse<String> reg = http.send(json(base + "/api/auth/register", token, """
                {"email":"New@Test.ua","fullName":"Нова Клієнтка","password":"довгий пароль без цифр","role":"MANAGER"}
                """), HttpResponse.BodyHandlers.ofString());
        assertThat(reg.statusCode()).isEqualTo(201);
        assertThat(reg.body()).contains("\"role\":\"CLIENT\"").contains("new@test.ua");

        HttpResponse<String> login = http.send(json(base + "/api/auth/login", xsrf(cookies),
                "{\"email\":\"new@test.ua\",\"password\":\"довгий пароль без цифр\"}"), HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);
        String setCookie = String.join(";", login.headers().allValues("Set-Cookie"));
        assertThat(setCookie).contains("JSESSIONID").containsIgnoringCase("HttpOnly").containsIgnoringCase("SameSite=Lax");

        HttpResponse<String> me = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/me")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(me.body()).contains("Нова Клієнтка");

        HttpResponse<String> logout = http.send(json(base + "/api/auth/logout", xsrf(cookies), ""),
                HttpResponse.BodyHandlers.ofString());
        assertThat(logout.statusCode()).isEqualTo(204);
        HttpResponse<String> after = http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/me")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(after.statusCode()).isEqualTo(204); // гість
    }

    private static String xsrf(CookieManager cookies) {
        return cookies.getCookieStore().getCookies().stream()
                .filter(c -> c.getName().equals("XSRF-TOKEN")).map(HttpCookie::getValue).findFirst().orElse(null);
    }

    private static HttpRequest json(String url, String token, String body) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (token != null) {
            b.header("X-XSRF-TOKEN", token);
        }
        return b.build();
    }
}
