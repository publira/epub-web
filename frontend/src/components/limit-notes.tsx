interface LimitNotesProps {
  title: string;
  items: string[];
}

export const LimitNotes = ({ title, items }: LimitNotesProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-3 border border-border bg-surface p-3">
      <h3 className="m-0 text-sm font-medium">{title}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <p
            key={item}
            className="m-0 border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  );
};
