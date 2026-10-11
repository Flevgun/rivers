# Rivers

Личный клиент для VLESS. Подписки, маршруты, геофайлы, ядра Xray и sing-box, логи. Имя от семьи Rivers.

Десктопная сборка для Windows. Установщик не нужен: распаковал архив и запустил `Rivers.exe`, откроется своё окно, не браузер.

## Скачать

**[Rivers для Windows 64-bit](https://github.com/Flevgun/rivers/releases/download/v1.1.0/Rivers-windows-64.zip)**

1. Распакуй архив в любую папку.
2. Запусти `Rivers.exe`.
3. Чтобы выключить, закрой окно.

Windows может написать, что издатель неизвестный. Это из-за того, что сборка без подписи. Нажми «Подробнее», затем «Выполнить в любом случае».

Клиент собирает конфиг и проверяет сервер. Системный туннель поднимает ядро на компьютере: Xray слушает SOCKS `127.0.0.1:10808`, sing-box поднимает TUN.

## Что внутри

- Подписки и отдельные ссылки `vless://`
- Режимы TUN и системный прокси
- Пресеты маршрутов: всё в прокси, RU напрямую, игры и RU, свой набор
- Ядра Xray и sing-box, конфиг можно править руками
- Геоисточники, логи, статистика

## Сборка из исходников

Нужен Node.js 22.

```bash
npm install
NITRO_PRESET=node npm run build
cd desktop && npm install && npm run pack
```

Архив появится в `desktop/dist/Rivers-windows-64.zip`.

## Контакты

- Email: [Flevgun@gmail.com](mailto:Flevgun@gmail.com)
- Telegram: [@flevgun](https://t.me/flevgun)
