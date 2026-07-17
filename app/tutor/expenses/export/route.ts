import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { EXPENSE_CATEGORY_LABELS, csvField, type ExpenseCategory } from "@/lib/expenses";

export async function GET(request: NextRequest) {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const yearParam = request.nextUrl.searchParams.get("year");
  const currentYear = new Date().getUTCFullYear();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : currentYear;

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, clients(student_name)")
    .eq("tutor_id", tutor.id)
    .gte("incurred_on", `${year}-01-01`)
    .lte("incurred_on", `${year}-12-31`)
    .order("incurred_on");

  const header = [
    "Date",
    "Category",
    "Amount",
    "Vendor",
    "Miles",
    "Mileage rate ($/mi)",
    "From",
    "To",
    "Student",
    "Note",
    "Has receipt",
  ];

  const rows = (expenses ?? []).map((e) => {
    const category = e.category as ExpenseCategory;
    const studentName = (e.clients as unknown as { student_name: string } | null)?.student_name ?? "";
    return [
      e.incurred_on,
      EXPENSE_CATEGORY_LABELS[category],
      (e.amount_cents / 100).toFixed(2),
      e.vendor ?? "",
      e.miles ?? "",
      e.mileage_rate_cents != null ? (e.mileage_rate_cents / 100).toFixed(2) : "",
      e.from_location ?? "",
      e.to_location ?? "",
      studentName,
      e.note ?? "",
      e.receipt_path ? "yes" : "no",
    ]
      .map(csvField)
      .join(",");
  });

  const csv = [header.map(csvField).join(","), ...rows].join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${year}.csv"`,
    },
  });
}
