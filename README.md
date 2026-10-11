# Rivers

Личный клиент для VLESS. Подписки, маршруты, геофайлы, ядра Xray и sing-box, логи. Имя от семьи Rivers.

Портативная сборка для Windows распаковывается и запускается, без установщика.

## Скачать

**[Rivers для Windows 64-bit](https://github.com/Flevgun/rivers/releases/download/v1.0.0/Rivers-windows-64.zip)**

Распакуй архив и запусти `Rivers.cmd`. Откроется страница на `http://127.0.0.1:8787`. Чтобы выключить, закрой чёрное окно.

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
npm run dev
```

Портативный сервер, тот же, что в архиве:

```bash
NITRO_PRESET=node npm run build
HOST=127.0.0.1 PORT=8787 node .output/server/index.mjs
```

## Контакты

- Email: [Flevgun@gmail.com](mailto:Flevgun@gmail.com)
- Telegram: [@flevgun](https://t.me/flevgun)
