package ua.opu.equiprent.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Перетворює винятки на відповіді формату Problem Details (RFC 9457)
 * з додатковими полями code та fieldErrors. Стек викликів клієнту не передається.
 * Стандартні помилки Spring MVC (неправильний формат JSON, відсутній параметр, метод
 * не підтримується тощо) обробляє базовий клас; тут до них додається код і текст українською.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String TYPE_PREFIX = "urn:equiprent:problem:";

    @ExceptionHandler(ApiException.class)
    public ProblemDetail handleApi(ApiException ex, HttpServletRequest request) {
        return problem(ex.getStatus(), ex.getCode(), ex.getMessage(), request.getRequestURI(), List.of());
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                                  HttpHeaders headers, HttpStatusCode status,
                                                                  WebRequest request) {
        List<Map<String, String>> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of("field", fe.getField(),
                        "message", fe.getDefaultMessage() == null ? "Некоректне значення" : fe.getDefaultMessage()))
                .toList();
        ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                "Перевірте правильність заповнення полів", path(request), fields);
        return ResponseEntity.badRequest().body(pd);
    }

    /** Уніфікує тіло стандартних помилок MVC: код, тип і повідомлення українською. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
                                                             HttpStatusCode statusCode, WebRequest request) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        String code = switch (status) {
            case BAD_REQUEST -> "BAD_REQUEST";
            case NOT_FOUND -> "NOT_FOUND";
            case METHOD_NOT_ALLOWED -> "METHOD_NOT_ALLOWED";
            case UNSUPPORTED_MEDIA_TYPE -> "UNSUPPORTED_MEDIA_TYPE";
            case NOT_ACCEPTABLE -> "NOT_ACCEPTABLE";
            default -> "HTTP_" + status.value();
        };
        String detail = switch (status) {
            case BAD_REQUEST -> "Запит має некоректний формат або пропущено обов'язковий параметр";
            case NOT_FOUND -> "Ресурс не знайдено";
            case METHOD_NOT_ALLOWED -> "Метод запиту не підтримується для цієї адреси";
            case UNSUPPORTED_MEDIA_TYPE -> "Непідтримуваний тип вмісту запиту";
            default -> status.getReasonPhrase();
        };
        ProblemDetail pd = problem(status, code, detail, path(request), List.of());
        return ResponseEntity.status(status).headers(headers).body(pd);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraint(ConstraintViolationException ex, HttpServletRequest request) {
        List<Map<String, String>> fields = ex.getConstraintViolations().stream()
                .map(v -> Map.of("field", String.valueOf(v.getPropertyPath()), "message", v.getMessage()))
                .toList();
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                "Перевірте правильність параметрів запиту", request.getRequestURI(), fields);
    }

    /** Остання лінія захисту: обмеження EXCLUDE у PostgreSQL (SQLSTATE 23P01). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        if (Sql.isExclusionViolation(ex)) {
            log.info("Конкурентний конфлікт відхилено обмеженням БД: {}", request.getRequestURI());
            return problem(HttpStatus.CONFLICT, "BOOKING_CONFLICT",
                    "Обраний період уже зайнятий. Оновіть календар і оберіть інші дати", request.getRequestURI(),
                    List.of());
        }
        log.warn("Порушення цілісності даних: {}", ex.getMostSpecificCause().getMessage());
        return problem(HttpStatus.CONFLICT, "DATA_CONFLICT",
                "Операцію відхилено: дані суперечать правилам цілісності", request.getRequestURI(), List.of());
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ProblemDetail handleOptimistic(OptimisticLockingFailureException ex, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION",
                "Запис щойно змінив інший користувач. Оновіть сторінку та повторіть дію", request.getRequestURI(),
                List.of());
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Неочікувана помилка під час обробки {} {}", request.getMethod(), request.getRequestURI(), ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "Внутрішня помилка сервера. Спробуйте пізніше", request.getRequestURI(), List.of());
    }

    private static String path(WebRequest request) {
        return request instanceof ServletWebRequest swr ? swr.getRequest().getRequestURI() : "";
    }

    static ProblemDetail problem(HttpStatus status, String code, String detail, String instance,
                                 List<Map<String, String>> fieldErrors) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setType(URI.create(TYPE_PREFIX + code.toLowerCase().replace('_', '-')));
        pd.setTitle(status.getReasonPhrase());
        pd.setInstance(URI.create(instance));
        pd.setProperty("code", code);
        if (!fieldErrors.isEmpty()) {
            pd.setProperty("fieldErrors", fieldErrors);
        }
        return pd;
    }
}
