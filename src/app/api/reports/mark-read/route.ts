import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 401, message: "未登录" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastReadReportsAt: new Date() },
  });

  return NextResponse.json({ code: 0 });
}
