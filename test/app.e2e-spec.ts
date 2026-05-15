/**
 * HTTP e2e contra un API ya levantado. Requiere E2E_BASE_URL (ej. http://127.0.0.1:3001).
 * Ver README: sección «E2E contra la API en marcha».
 */
import request from 'supertest';

const baseUrl = process.env.E2E_BASE_URL;

const e2e = baseUrl ? describe : describe.skip;

e2e('API (e2e) — set E2E_BASE_URL (e.g. http://127.0.0.1:3000) with API running', () => {
  const req = () => request(baseUrl!);

  it('GET /', () => {
    return req().get('/').expect(200).expect('Hello World!');
  });

  it('prescription workflow', async () => {
    const suffix = Date.now();
    const doctorEmail = `e2e-dr-${suffix}@test.com`;
    const patientEmail = `e2e-patient-${suffix}@test.com`;

    await req()
      .post('/auth/register')
      .send({
        email: doctorEmail,
        password: 'password123',
        name: 'E2E Doctor',
        role: 'doctor',
        speciality: 'General',
      })
      .expect(201);

    await req()
      .post('/auth/register')
      .send({
        email: patientEmail,
        password: 'password123',
        name: 'E2E Patient',
        role: 'patient',
        birthDate: '1990-01-15',
      })
      .expect(201);

    const patientLogin = await req()
      .post('/auth/login')
      .send({ email: patientEmail, password: 'password123' })
      .expect(201);
    const patientAccess = patientLogin.body.accessToken as string;

    const patientProfile = await req()
      .get('/auth/profile')
      .set('Authorization', `Bearer ${patientAccess}`)
      .expect(200);

    const patientId = patientProfile.body.patient?.id as number;
    expect(patientId).toBeDefined();

    const doctorLogin = await req()
      .post('/auth/login')
      .send({ email: doctorEmail, password: 'password123' })
      .expect(201);
    const doctorAccess = doctorLogin.body.accessToken as string;

    const created = await req()
      .post('/prescriptions')
      .set('Authorization', `Bearer ${doctorAccess}`)
      .send({
        patientId,
        notes: 'E2E test',
        items: [
          {
            name: 'Amoxicilina 500mg',
            dosage: '1 c/8h',
            quantity: 15,
            instructions: 'Después de comer',
          },
        ],
      })
      .expect(201);

    const rxId = created.body.id as number;
    expect(rxId).toBeDefined();

    const mine = await req()
      .get('/me/prescriptions')
      .set('Authorization', `Bearer ${patientAccess}`)
      .expect(200);
    expect(mine.body.data.some((r: { id: number }) => r.id === rxId)).toBe(true);

    await req()
      .put(`/prescriptions/${rxId}/consume`)
      .set('Authorization', `Bearer ${patientAccess}`)
      .expect(200);

    const adminLogin = await req().post('/auth/login').send({
      email: 'admin@test.com',
      password: 'admin123',
    });

    if (adminLogin.status !== 201) {
      return;
    }

    const adminAccess = adminLogin.body.accessToken as string;

    const metrics = await req()
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(200);

    expect(metrics.body).toHaveProperty('totals');
    expect(metrics.body).toHaveProperty('byStatus');
    expect(metrics.body).toHaveProperty('byDay');
    expect(metrics.body).toHaveProperty('topDoctors');
  });
});
