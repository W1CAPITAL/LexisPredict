import { NextResponse } from 'next/server';
import { ScannerService } from '@/modules/process-scanner/services/scanner-service';

/**
 * @fileOverview Endpoint de Triagem Unitária MNI
 */

export async function POST(req: Request) {
  try {
    const { cnj, empresaId } = await req.json();
    
    if (!cnj) return NextResponse.json({ error: "CNJ requerido" }, { status: 400 });

    const scanner = new ScannerService();
    const result = await scanner.scanProcesso(cnj, empresaId);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
