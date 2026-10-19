# オリジナル馬券ジェネレーター

単勝・複勝・応援馬券の画像をブラウザ内で作成するPC向け静的サイトです。入力内容と背景画像は外部へ送信しません。状態の永続化はなく、再読み込みで初期値に戻ります。

## 起動

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

http://127.0.0.1:8000/ を開きます。Node.jsやビルド作業は不要です。

## GitHub Pages

すべてのアセットを相対URLで参照しているため、プロジェクトサイトのサブパスで配信できます。`.github/workflows/pages.yml` は main へのpushまたは手動実行時にサイトをデプロイします。リポジトリの Settings → Pages → Source を **GitHub Actions** に設定してください。初回はSourceの設定後、Actions → Deploy GitHub Pages → Run workflow を実行してください。Pagesが未有効な間はpush時のデプロイをスキップします。現在はリポジトリが非公開・Pages未有効で、連携からPages設定を変更する権限がないため、実際の公開URLは未確認です。

## 機能

- 1頭の単勝・複勝、および同額の単複セットである応援馬券
- 券面の枚数は合計金額÷10で表示
- 即時プレビュー、項目別バリデーション、1600×980px PNG保存
- JPEG・PNG・WebP（20MB以下）の背景、位置・拡大・薄さの調整
- 背景を指定した場合は地模様と透かしを非表示。コードは黒部分のみ描画
- 日本時間の当日を初期日付に採用
- フォントを同梱し、読み込みが完了するまで保存を停止

`app.js` の券面論理座標は800×490、Canvas解像度はその2倍です。プレビューと保存画像で同じCanvasを使用します。地模様・透かし・コード・管理印字は低解像度の参考画像に基づく近似で、コードは固定装飾です。

## 参考・ライセンス

JRA公式の[単勝](https://www.jra.go.jp/kouza/beginner/baken/img/baken_tansyo.jpg)・[複勝](https://www.jra.go.jp/kouza/beginner/baken/img/baken_fukusyo.jpg)・[応援](https://www.jra.go.jp/kouza/beginner/baken/img/baken_ouen.jpg)画像をレイアウトの参考にしています。参考画像自体はサイトに同梱していません。

Jost、Roboto Condensed、Dela Gothic One、Noto Sans JP、Noto Serif JPを同梱しています。著作権表示とSIL Open Font License全文は `fonts/*-OFL.txt` および `fonts/LICENSES.html` を参照してください。

## 確認用画像

[菊花賞の設定例（PNG）](docs/kikka-win.png) · [単勝](docs/win.png) · [複勝](docs/place.png) · [応援](docs/cheer.png)

![編集画面](docs/preview.png)

ブラウザ検証の結果は [docs/VERIFICATION.md](docs/VERIFICATION.md) を参照してください。
