<?php
/*
 * Export de la Academia para `scripts/backfill_subscriptions.py` y `scripts/vincular_alumnos_academia.py`
 * (docs/plan_personas.md, 22/10/2026). Solo lee. Se corre en el servidor de la Academia, no en Work:
 *
 *   railway ssh -p <proyecto Learnation Academy> -s learnation -e production -- \
 *     sh -c 'cat > /tmp/export.php && cd /app && php /tmp/export.php' < scripts/academia_export.php > academia.json
 *
 * Devuelve {"users": [...], "asig": [...]}: los usuarios (id, work_id, nombre, mail, rol) y cada asignación de
 * producto (`product_user`) con su producto, estado, vencimiento, si es seña, quién la dio y cuándo se creó y
 * se modificó por última vez (una renovación o prórroga suele extender la misma fila).
 */
require '/app/vendor/autoload.php';
$app = require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$users = DB::table('users')->select('id', 'work_id', 'name', 'email', 'phone', 'role', 'created_at')->get();
$asig = DB::table('product_user as pu')
    ->join('products as p', 'p.id', '=', 'pu.product_id')
    ->leftJoin('users as a', 'a.id', '=', 'pu.assigned_by')
    ->select('pu.id', 'pu.user_id', 'p.slug', 'pu.status', 'pu.expires_at', 'pu.created_at', 'pu.updated_at',
             'pu.is_deposit', 'a.name as asignado_por')
    ->get();
echo json_encode(['users' => $users, 'asig' => $asig]);
