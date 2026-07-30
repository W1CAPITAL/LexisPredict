import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um link de WhatsApp de forma resiliente.
 */
export function formatWhatsAppLink(phone: string, text?: string) {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  const finalPhone = (cleanPhone.length === 10 || cleanPhone.length === 11) ? `55${cleanPhone}` : cleanPhone;
  const encodedText = text ? encodeURIComponent(text) : '';
  return `https://wa.me/${finalPhone}${encodedText ? `?text=${encodedText}` : ''}`;
}

/**
 * Valida se uma string segue o padrão canônico de número de processo CNJ.
 * Padrão: NNNNNNN-DD.AAAA.J.TR.OOOO
 */
export function isCNJ(numero: string): boolean {
  if (!numero) return false;
  // Regex flexível que aceita com ou sem pontuação: NNNNNNNDDAAAAJTROOOO ou NNNNNNN-DD.AAAA.J.TR.OOOO
  const cnjRegex = /^\d{7}-?\d{2}\.?\d{4}\.?(1|4|5|8)\.?\d{2}\.?\d{4}$/;
  return cnjRegex.test(numero.trim());
}

/**
 * Calcula a luminância de uma cor hex para verificar contraste.
 */
export function getLuminance(hex: string) {
  const cleanHex = hex.replace(/^#/, '');
  const rgb = cleanHex.length === 3 
    ? cleanHex.split('').map(x => parseInt(x + x, 16) / 255)
    : cleanHex.match(/.{2}/g)?.map(x => parseInt(x, 16) / 255) || [0, 0, 0];
  
  const res = rgb.map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * res[0] + 0.7152 * res[1] + 0.0722 * res[2];
}

/**
 * Calcula a razão de contraste entre duas cores.
 */
export function getContrastRatio(hex1: string, hex2: string) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Retorna a cor de texto ideal (Preto ou Branco) baseada na cor de fundo.
 */
export function getIdealTextColor(bgColor: string) {
  return getLuminance(bgColor) > 0.45 ? "#000000" : "#FFFFFF";
}

/**
 * Retorna uma versão "muted" da cor de texto (Cinza escuro ou Cinza claro).
 */
export function getIdealMutedTextColor(bgColor: string) {
  return getLuminance(bgColor) > 0.45 ? "#4B5563" : "#9CA3AF";
}
