import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { renderResumeTemplateHtml } from "@/lib/render-resume-template-html";
import type { StructuredResumeData } from "@/types/resume";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { structuredResumeData, candidateName } = (await req.json()) as {
      structuredResumeData: StructuredResumeData;
      candidateName?: string;
    };

    if (!structuredResumeData?.personal?.name) {
      return NextResponse.json(
        { error: "Invalid structured resume data" },
        { status: 400 }
      );
    }

    const html = renderResumeTemplateHtml(structuredResumeData);

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });

    await browser.close();

    const filename =
      (candidateName || structuredResumeData.personal.name || "resume")
        .replace(/\s+/g, "_") + "_Agencity.pdf";

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Export resume PDF error:", err);
    return NextResponse.json(
      { error: "Failed to generate resume PDF" },
      { status: 500 }
    );
  }
}


