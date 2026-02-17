# Skriptide kasutusjuhend

See kaust sisaldab kahte skripti:
- `backup-workspace.sh` — loob tööruumist backupi
- `restore-workspace.sh` — taastab valitud backupi

## Eeldused

- Linux/macOS shell (bash)
- `tar` paigaldatud
- Soovituslik: `zstd` (kui olemas, kasutatakse väiksemaid `.tar.zst` faile)

## Backupi loomine

Käivita projekti juurkaustast:

```bash
./scripts/backup-workspace.sh
```

Tulemus:
- Luakse ajatempliga backup kausta `../_workspace_backups/podcasts`
- Hoitakse ainult 3 viimast backupi
- Vanim backup eemaldatakse automaatselt

Vaikimisi jäetakse backupist välja suured/ajutised kaustad nagu `node_modules`, `dist`, `.vite` jne.

## Taastamine backupist

### Taasta praegusesse kausta

```bash
./scripts/restore-workspace.sh
```

### Taasta kindlasse kausta

```bash
./scripts/restore-workspace.sh /tee/sihtkaust
```

Skript:
- Kuvab backupide loendi
- Laseb valida numbri alusel, millist backupi taastada
- Küsib kinnitust, kui sihtkaust ei ole tühi

## Soovitus nullist taastamiseks

1. Loo uus tühi kaust
2. Kopeeri sinna `restore-workspace.sh` (või käivita skript olemasolevast projektist)
3. Käivita taastamine sihtkausta
4. Mine taastatud kausta ja paigalda sõltuvused:

```bash
npm ci
```

5. Kontrolli buildi:

```bash
npm run build
```
