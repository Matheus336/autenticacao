import { useEffect, useRef, useState } from "react";
import { getProfilePhoto, uploadProfilePhoto } from "../api/session";
import { getErrorMessage } from "../utils/errors";

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function useProfilePhoto() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const photoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;

    getProfilePhoto()
      .then((photo) => {
        if (!photo || !isActive) return;
        const url = URL.createObjectURL(photo);
        photoUrlRef.current = url;
        setPhotoUrl(url);
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(
            getErrorMessage(
              requestError,
              "Não foi possível carregar a foto de perfil.",
            ),
          );
        }
      });

    return () => {
      isActive = false;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, []);

  async function choosePhoto(photo: File) {
    setError("");
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      setError("Escolha uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (photo.size === 0 || photo.size > MAX_PHOTO_SIZE) {
      setError("A foto deve ter no máximo 2 MB.");
      return;
    }

    setLoading(true);
    try {
      await uploadProfilePhoto(photo);
      const nextUrl = URL.createObjectURL(photo);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = nextUrl;
      setPhotoUrl(nextUrl);
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, "Não foi possível salvar a foto."),
      );
    } finally {
      setLoading(false);
    }
  }

  return { photoUrl, error, loading, choosePhoto };
}
