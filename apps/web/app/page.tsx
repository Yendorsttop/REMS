const capabilities = [
  'Executive identity lifecycle',
  'Organizational hierarchy',
  'Membership and reporting relationships',
  'Role and permission assignments',
];
export default function Home() {
  return (
    <main>
      <p className="eyebrow">REMS · RED-001</p>
      <h1>
        Executive authority,
        <br />
        <span>constitutionally bounded.</span>
      </h1>
      <p className="lede">
        Foundation console for the exclusive executive identity and organizational authority domain.
        Operational integrations remain deliberately explicit and evidence-gated.
      </p>
      <section aria-labelledby="capabilities">
        <div>
          <p className="section-label">Authoritative boundary</p>
          <h2 id="capabilities">One governed source of organizational participation.</h2>
        </div>
        <ul>
          {capabilities.map((item, index) => (
            <li key={item}>
              <span>0{index + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      </section>
      <aside>
        <strong>Foundation status</strong>
        <p>
          Domain logic and executable verification are present. Production persistence, OIDC
          verification, database grants, and operational certification remain pending.
        </p>
      </aside>
    </main>
  );
}
