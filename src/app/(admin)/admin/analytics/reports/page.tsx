"use client";

import { Card, Icon, PrimaryButton } from "@/components/transport/ui";
import { useStore } from "@/lib/transport/store";

export default function ReportsPage() {
  const { dispatch } = useStore();

  return (
    <Card className="px-6 py-14 text-center">
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-neutral-tint text-faint">
        <Icon name="description" size={24} />
      </span>
      <div className="text-sm font-semibold">No scheduled reports yet</div>
      <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-faint text-pretty">
        Create a recurring export for attendance, trip performance or safety events and it will
        arrive by email.
      </p>
      <div className="mt-4 flex justify-center">
        <PrimaryButton
          onClick={() =>
            dispatch({ type: "toast", message: "Report builder opens once exports are wired up" })
          }
        >
          Create report
        </PrimaryButton>
      </div>
    </Card>
  );
}
