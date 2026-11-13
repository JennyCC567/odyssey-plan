import { NextResponse } from "next/server";
import { z } from "zod";
import { createBaziProfile } from "../../lib/bazi";
import { calculateBaziRaw } from "../../lib/bazi_calculator";
import { isSupportedCity } from "../../lib/cities";

const requestSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
  hour: z.coerce.number().int().min(0).max(23),
  minute: z.coerce.number().int().min(0).max(59),
  gender: z.enum(["男", "女"]),
  city: z.string().min(1).max(20).refine((city) => isSupportedCity(city), {
    message: "请选择城市列表中的城市。"
  })
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    const cityIssue = parsed.error.issues.find((issue) => issue.path[0] === "city");

    return NextResponse.json(
      {
        message: cityIssue?.message ?? "出生信息格式不完整，请检查年月日、时间、性别和城市。"
      },
      { status: 400 }
    );
  }

  try {
    const raw = calculateBaziRaw(parsed.data);
    const profile = createBaziProfile(raw, parsed.data.year);

    return NextResponse.json({
      raw,
      profile
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "排盘失败，请稍后重试。"
      },
      { status: 500 }
    );
  }
}
