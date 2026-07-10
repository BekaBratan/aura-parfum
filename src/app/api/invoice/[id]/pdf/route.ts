import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const pdfMake = require("pdfmake/build/pdfmake");
const vfs = require("pdfmake/build/vfs_fonts");
pdfMake.addVirtualFileSystem(vfs);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const kztRate = (order as { kzt_rate?: number | null }).kzt_rate ?? 460;

  const { buildInvoicePdfDefinition } = await import("@/lib/pdf");
  const docDef = buildInvoicePdfDefinition(order as any, kztRate);
  const pdfBuffer = await pdfMake.createPdf(docDef).getBuffer();

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.invoice_number}.pdf"`,
    },
  });
}
