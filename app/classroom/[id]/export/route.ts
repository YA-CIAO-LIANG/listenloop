import { getTranslations } from "next-intl/server";
import {
  assignedMaterials,
  classDetail,
  classProgressRows,
} from "@/auth/classroom";
import { classReport, reportCsv } from "@/lib/classroom";

/** The class's progress as CSV (D103): the teacher only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await classDetail(id);
  if (!detail?.teacher) return new Response(null, { status: 404 });
  const [t, rows, materials] = await Promise.all([
    getTranslations("classroom"),
    classProgressRows(id),
    assignedMaterials(detail.assignments.map((a) => a.videoId)),
  ]);
  const reports = classReport(
    detail.members,
    detail.assignments,
    rows,
    materials,
  );
  const csv = reportCsv(reports, [
    t("csv.assignment"),
    t("csv.due"),
    t("csv.student"),
    t("csv.daysDone"),
    t("csv.status"),
    ...[1, 2, 3, 4, 5, 6, 7].map((day) => t("csv.day", { day })),
    t("csv.improvement"),
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="class-${id.slice(0, 8)}.csv"`,
    },
  });
}
