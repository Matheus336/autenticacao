import { QRCodeSVG } from "qrcode.react";
import type { TotpSetupProps } from "../../types/totp";

export default function TotpSetup({ setup, description }: TotpSetupProps) {
  return (
    <div className="totp-setup">
      <p>{description}</p>
      <div className="totp-qr">
        <QRCodeSVG
          value={setup.otpauthUrl}
          size={192}
          level="M"
          title="QR code para configurar a autenticação multifator"
        />
      </div>
      <p className="totp-qr-hint">
        Escaneie o QR code com seu aplicativo autenticador.
      </p>
      <details className="totp-manual-setup">
        <summary>
          Não consegue escanear? <br />
          Mostrar chave manual
        </summary>
        <code style={{ color: "#FFF" }}>{setup.secret}</code>
        <br />
      </details>
    </div>
  );
}
