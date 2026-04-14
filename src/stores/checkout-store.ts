import { create } from "zustand";

type States = {
  name: string;
  phone: string;
  cpf: string;
  address: {
    street: string;
    number: string;
    complement?: string | undefined;
    district: string;
    city: string;
    state: string;
  }
  deliveryType: 'delivery' | 'pickup' | null
  paymentMethod: string | null
  payWhen: 'now' | 'on-delivery' | null
  deliveryFee: number
  change: number | null   // ← novo: troco (0 = sem troco, null = não definido)
}

type Actions = {
  setName: (name: States["name"]) => void;
  setPhone: (phone: string) => void;
  setCpf: (cpf: string) => void;
  setAddress: (address: States["address"]) => void;
  setDeliveryType: (type: 'delivery' | 'pickup') => void;
  setPaymentMethod: (method: string) => void;
  setPayWhen: (when: 'now' | 'on-delivery') => void;
  setDeliveryFee: (fee: number) => void;
  setChange: (change: number | null) => void   // ← novo
}

const initialState: States = {
  name: '',
  phone: '',
  cpf: '',
  address: {
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: ''
  },
  deliveryType: null,
  paymentMethod: null,
  payWhen: null,
  deliveryFee: 0,
  change: null,   // ← novo
}

export const useCheckoutStore = create<States & Actions>()(set => ({
  ...initialState,
  setName:          (name)          => set(state => ({ ...state, name })),
  setPhone:         (phone)         => set(state => ({ ...state, phone })),
  setCpf:           (cpf)           => set(state => ({ ...state, cpf })),
  setAddress:       (address)       => set(state => ({ ...state, address })),
  setDeliveryType:  (deliveryType)  => set(state => ({ ...state, deliveryType })),
  setPaymentMethod: (paymentMethod) => set(state => ({ ...state, paymentMethod })),
  setPayWhen:       (payWhen)       => set(state => ({ ...state, payWhen })),
  setDeliveryFee:   (deliveryFee)   => set(state => ({ ...state, deliveryFee })),
  setChange:        (change)        => set(state => ({ ...state, change })),   // ← novo
}));
