import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StudentForm } from "@/components/students/student-form";
import { createStudentAction } from "@/app/tutor/students/actions";

export default function NewStudentPage() {
  return (
    <div>
      <PageHeader title="Add student" description="Set their rate rule now — you can change it any time." />
      <Card className="max-w-2xl">
        <StudentForm action={createStudentAction} onSuccessPath="/tutor/students" />
      </Card>
    </div>
  );
}
