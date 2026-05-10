import { createToastInterface, POSITION } from 'vue-toastification'
import 'vue-toastification/dist/index.css'

export const toast = createToastInterface({
  position: POSITION.TOP_RIGHT,
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  maxToasts: 5,
})
