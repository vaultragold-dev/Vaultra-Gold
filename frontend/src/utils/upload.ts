import { Platform } from "react-native";

/** Multipart form for a local file (image/audio/document) that works on web and on real phones. */
export async function uploadForm(uri: string, field = "file", name = "upload.jpg") {
  const form = new FormData();
  if (Platform.OS === "web") {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      form.append(field, blob, name);
    } catch {
      form.append(field, { uri, type: "image/jpeg", name } as any);
    }
  } else {
    form.append(field, {
      uri,
      type: "image/jpeg",
      name: name || "upload.jpg",
    } as any);
  }
  return form;
}
