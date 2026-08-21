interface LimitNotesProps {
  title: string;
  items: string[];
}

export const LimitNotes = ({ title, items }: LimitNotesProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-primary/20 bg-primary-subtle/70 mt-3 rounded-xl border p-3">
      <h3 className="text-primary/90 m-0 text-sm font-semibold">{title}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <p
            key={item}
            className="border-primary/15 bg-card-surface text-muted-foreground m-0 rounded-lg border px-3 py-2 text-sm"
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  );
};
