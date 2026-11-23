#!/bin/bash
# Знімає реальні приклади запитів і відповідей API для додатка В (застосунок має працювати на :8080)
set -e
B=http://localhost:8080; J=$(mktemp); export NO_PROXY=localhost no_proxy=localhost; C="curl -s -b $J -c $J"
$C $B/api/auth/csrf >/dev/null
tok() { grep XSRF-TOKEN $J | awk '{print $7}'; }
$C -H "X-XSRF-TOKEN: $(tok)" -H 'Content-Type: application/json' -d '{"email":"taras@equiprent.test","password":"Client-Demo-2026!"}' $B/api/auth/login >/dev/null
$C $B/api/auth/csrf >/dev/null
START=$(date -d "+${1:-40} days" +%F); END=$(date -d "+$(( ${1:-40} + 3 )) days" +%F)
BODY="{\"equipmentTypeId\":5,\"startDate\":\"$START\",\"endDate\":\"$END\",\"comment\":\"Заберу після 16:00\"}"
echo "### POST /api/bookings"; echo "$BODY"; echo "--- відповідь"
$C -i -H "X-XSRF-TOKEN: $(tok)" -H 'Content-Type: application/json' -d "$BODY" $B/api/bookings | sed 's/\r$//' | grep -iE '^HTTP|^content-type|^x-request-id|^\{'
# Вичерпати всі екземпляри типу 5 на ці дати, щоб отримати конфлікт
for i in 1 2 3 4 5 6; do $C -o /dev/null -H "X-XSRF-TOKEN: $(tok)" -H 'Content-Type: application/json' -d "$BODY" $B/api/bookings; done
echo; echo "### POST /api/bookings (ті самі дати, вільних екземплярів немає)"; echo "--- відповідь"
$C -i -H "X-XSRF-TOKEN: $(tok)" -H 'Content-Type: application/json' -d "$BODY" $B/api/bookings | sed 's/\r$//' | grep -iE '^HTTP|^content-type|^\{'
echo; echo "### POST /api/bookings (кінець раніше початку)"; echo "--- відповідь"
$C -i -H "X-XSRF-TOKEN: $(tok)" -H 'Content-Type: application/json' -d "{\"equipmentTypeId\":5,\"startDate\":\"$END\",\"endDate\":\"$START\"}" $B/api/bookings | sed 's/\r$//' | grep -iE '^HTTP|^\{'
echo; echo "### POST /api/bookings (без обов’язкових полів)"; echo "--- відповідь"
$C -i -H "X-XSRF-TOKEN: $(tok)" -H 'Content-Type: application/json' -d '{}' $B/api/bookings | sed 's/\r$//' | grep -iE '^HTTP|^\{'
rm -f $J
