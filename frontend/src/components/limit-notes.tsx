interface LimitNotesProps {
  title: string;
  items: string[];
}

export const LimitNotes = ({ title, items }: LimitNotesProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-3 rounded-xl border border-primary/20 bg-primary-subtle/70 p-3">
      <h3 className="m-0 text-sm font-semibold text-primary/90">{title}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <p
            key={item}
            className="m-0 rounded-lg border border-primary/15 bg-card-surface px-3 py-2 text-sm text-muted-foreground"
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  );
};
