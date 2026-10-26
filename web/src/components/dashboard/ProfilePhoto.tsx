import { useRef } from "react";
import { useProfilePhoto } from "../../hooks/useProfilePhoto";

type Props = { fullName: string };

export default function ProfilePhoto({ fullName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { photoUrl, error, loading, choosePhoto } = useProfilePhoto();
  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <section className="profile-photo" aria-label="Foto de perfil">
      <div className="profile-avatar">
        {photoUrl ? (
          <img src={photoUrl} alt={`Foto de perfil de ${fullName}`} />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Selecionar foto de perfil"
        onChange={(event) => {
          const photo = event.target.files?.[0];
          if (photo) void choosePhoto(photo);
          event.target.value = "";
        }}
      />
      <button
        className="dashboard-secondary-button"
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? "Salvando foto..." : photoUrl ? "Alterar foto" : "Adicionar foto"}
      </button>
      <p className="photo-help">JPEG, PNG ou WebP; máximo de 2 MB.</p>
      {error && (
        <p className="dashboard-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
