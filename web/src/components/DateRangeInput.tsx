interface Props {
  dateDebut: string;
  dateFin: string;
  onChangeDebut: (v: string) => void;
  onChangeFin: (v: string) => void;
  required?: boolean;
  labelDebut?: string;
  labelFin?: string;
}

export function DateRangeInput({
  dateDebut,
  dateFin,
  onChangeDebut,
  onChangeFin,
  required = true,
  labelDebut = "Date de début",
  labelFin = "Date de fin",
}: Props) {
  const invalid =
    dateDebut !== "" && dateFin !== "" && dateFin < dateDebut;
  return (
    <>
      <label>{labelDebut}</label>
      <input
        type="date"
        value={dateDebut ?? ""}
        onChange={(e) => onChangeDebut(e.target.value)}
        required={required}
      />
      <label>{labelFin}</label>
      <input
        type="date"
        value={dateFin ?? ""}
        onChange={(e) => onChangeFin(e.target.value)}
        required={required}
        style={invalid ? { borderColor: "#c62828" } : undefined}
      />
      {invalid && (
        <small style={{ color: "#c62828" }}>
          La date de fin doit être ≥ à la date de début.
        </small>
      )}
    </>
  );
}
