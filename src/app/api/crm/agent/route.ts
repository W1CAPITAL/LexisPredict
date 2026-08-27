import { NextRequest, NextResponse } from "next/server";
import { runCrmAgentAction, agentListOutstandingAction } from "@/app/actions/crm-agent-actions";

export async function GET() {
  const out = await agentListOutstandingAction();
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await runCrmAgentAction({
      agent_id: body.agent_id || "livre",
      prompt: body.prompt,
      negocioId: body.negocioId,
      protocolo: body.protocolo,
    });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "payload" }, { status: 400 });
  }
}
