#!/bin/bash
# Перезапуск застосунку на навчальному стенді (без зміни бази даних)
pkill -f '^java -jar target/equiprent'; sleep 2
cd "$(dirname "$0")/../backend" && (nohup java -jar target/equiprent-1.0.0.jar >> /tmp/app.log 2>&1 &)
for i in $(seq 1 60); do curl -sf localhost:8080/actuator/health/readiness >/dev/null && break; sleep 1; done
