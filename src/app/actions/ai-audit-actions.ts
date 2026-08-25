"use server";

/**
 * Auditoria de contrato / SWOT de caso — usa o cofre de prompts (padrão menu/SWOT).
 */
import { processChat } from "@/lib/ai/chat-service";
import {
  buildContractAuditUserMessage,
  buildCaseSwotUserMessage,
} from "@/lib/ai/prompts";

export async function auditContractAction(input: {
  text: string;
  contractType?: string;
  focus?: "clausulas" | "cdc" | "swot" | "completo";
}): Promise<{ success: boolean; content: string; error?: string }> {
  const text = String(input.text || "").trim();
  if (text.length < 40) {
    return { success: false, content: "", error: "Cole um trecho maior do contrato (mín. ~40 caracteres)." };
  }
  const message = buildContractAuditUserMessage({
    text,
    contractType: input.contractType,
    focus: input.focus || "completo",
  });
  const res = await processChat({
    message,
    contextType: "contract_audit",
    temperature: 0.3,
  });
  return {
    success: !!res.success,
    content: res.content || "",
    error: res.error,
  };
}

export async function caseSwotAction(input: {
  cliente?: string;
  protocolo?: string;
  situacao?: string;
  flags?: string;
  andamentos?: string;
  observacao?: string;
}): Promise<{ success: boolean; content: string; error?: string }> {
  const message = buildCaseSwotUserMessage(input);
  const res = await processChat({
    message,
    contextType: "case_swot",
    temperature: 0.35,
  });
  return {
    success: !!res.success,
    content: res.content || "",
    error: res.error,
  };
}
