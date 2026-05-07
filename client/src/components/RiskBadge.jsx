function RiskBadge({ severity }) {
  let colorClass = 'risk-low';
  if (severity === 'medium') colorClass = 'risk-medium';
  if (severity === 'high') colorClass = 'risk-high';

  return (
    <span className={`badge ${colorClass}`}>
      {severity.toUpperCase()}
    </span>
  );
}

export default RiskBadge;
