import {
  Toaster as ToasterRoot,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastCloseTrigger,
} from "../ui/toast";
import { toaster } from "./useToast";

export default function ToastUI() {
  return (
    <ToasterRoot toaster={toaster}>
      {(toast) => (
        <ToastRoot key={toast.id}>
          <ToastTitle>{toast.title}</ToastTitle>
          <ToastDescription>{toast.description}</ToastDescription>
          <ToastCloseTrigger />
        </ToastRoot>
      )}
    </ToasterRoot>
  );
}
