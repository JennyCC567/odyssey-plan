import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createBaziProfile, type BaziCalculatorResult } from "../../lib/bazi";

const requestSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
  hour: z.coerce.number().int().min(0).max(23),
  minute: z.coerce.number().int().min(0).max(59),
  gender: z.enum(["男", "女"]),
  city: z.string().min(1).max(20)
});

function runBaziCalculator(input: z.infer<typeof requestSchema>) {
  return new Promise<BaziCalculatorResult>((resolve, reject) => {
    const cwd = process.cwd();
    const pythonPath = path.join(cwd, ".venv", "bin", "python");
    const scriptPath = path.join(cwd, "八字命理分析", "scripts", "bazi_calculator.py");
    const args = [
      scriptPath,
      `year=${input.year}`,
      `month=${input.month}`,
      `day=${input.day}`,
      `hour=${input.hour}`,
      `minute=${input.minute}`,
      `gender=${input.gender}`,
      `city=${input.city}`
    ];

    const child = spawn(pythonPath, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `bazi calculator exited with ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as BaziCalculatorResult);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "出生信息格式不完整，请检查年月日、时间、性别和城市。"
      },
      { status: 400 }
    );
  }

  try {
    const raw = await runBaziCalculator(parsed.data);
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
