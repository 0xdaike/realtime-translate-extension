export function PrivacyNotice() {
  return (
    <section className="panel privacy-panel">
      <div className="panel-heading">
        <p className="eyebrow">Privacy</p>
        <h2>プライバシーと送信先</h2>
      </div>

      <p>
        この拡張機能は、現在のタブ音声を選択中の翻訳サービスへ送信します。
        BYOKモードではOpenAIまたはSonioxへ、Managedモードでは自社APIが発行した短命セッションへ送信します。
      </p>
      <p>
        Content Scriptは表示専用です。標準APIキー、短命セッションtoken、音声、パスフレーズはページDOMへ渡しません。
        音声・字幕・会議内容・翻訳履歴は拡張機能内に保存しません。
      </p>
      <p>
        BYOKモードのAPI利用料金はユーザー自身のOpenAIまたはSonioxアカウントに発生します。
        Managedモードの契約状態、利用上限、課金は自社API側で管理します。
        機密情報を含む会議で使う場合は、所属組織のルールと参加者の同意を確認してください。
      </p>
    </section>
  );
}
