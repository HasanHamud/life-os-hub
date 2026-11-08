import { useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatWhen } from "@/core/utils";

function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function DayPickerButton({
  day,
  onChange,
  marked,
}: {
  day: string | null;
  onChange: (day: string) => void;
  marked?: Date[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" aria-label={t("journal.pickDate")}>
          {day ? formatWhen(parseDay(day), "EEEE, MMMM d, yyyy") : t("journal.allDates")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="single"
          selected={day ? parseDay(day) : undefined}
          defaultMonth={day ? parseDay(day) : new Date()}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          modifiers={marked?.length ? { hasLog: marked } : undefined}
          modifiersClassNames={{
            hasLog:
              "relative font-semibold after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
