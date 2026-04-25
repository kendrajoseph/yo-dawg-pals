export const MAX_PROFILE_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

export const validateProfileImageFile = (file: File) => {
  if (!file.type.startsWith("image/")) {
    return "Please select an image file";
  }

  if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    return "Image must be under 8MB";
  }

  return null;
};