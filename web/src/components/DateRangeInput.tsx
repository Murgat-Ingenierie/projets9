import { useId } from "react";

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
  // Ce composant porte À LA FOIS ses libellés et ses champs : il fabrique donc
  // lui-même les identifiants qui les relient. `useId` garantit leur unicité
  // même quand plusieurs plages de dates coexistent sur un écran.
  const id = useId();
  const invalid =
    dateDebut !== "" && dateFin !== "" && dateFin < dateDebut;
  return (
    <>
      <label htmlFor={`${id}-debut`}>{labelDebut}</label>
      <input
        id={`${id}-debut`}
        type="date"
        value={dateDebut ?? ""}
        onChange={(e) => onChangeDebut(e.target.value)}
        required={required}
      />
      <label htmlFor={`${id}-fin`}>{labelFin}</label>
      <input
        id={`${id}-fin`}
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
