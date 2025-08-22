# Crush CLI Visualization

An interactive CLI tool to visualize how CrushMap configurations distribute data across shards.

## Features

- **Template Selection**: Choose from pre-configured CrushMap templates
- **Real-time Visualization**: Watch shard access patterns update every second
- **Distribution Statistics**: See access counts and percentages for each shard
- **Access Log**: View recent access history with ID, PG, and shard information
- **Interactive Controls**: Pause/resume simulation with spacebar

## Usage

```bash
bun debug/crush-cli.tsx
```

## Templates Available

1. **Simple 2-Shard**: Basic setup with 2 shards and 8 placement groups
2. **4-Shard Balanced**: 4 equally weighted shards with 16 PGs
3. **Weighted Distribution**: 3 shards with 2:1:1 weight ratio
4. **Multi-Zone Setup**: 6 shards distributed across 3 zones
5. **Large Scale**: 10 shards with 128 PGs for high throughput
6. **Replica Setup**: 3 shards with 2 replicas each

## Controls

- **↑/↓ arrows**: Navigate template selection
- **Enter**: Confirm template selection
- **Space**: Pause/resume the simulation
- **Q**: Quit the application

## Visualization Elements

### Shard Access Distribution

- Bar chart showing relative access frequency
- Current shard being accessed is highlighted in yellow
- Shows total access count and percentage for each shard

### Recent Accesses

- Shows the last 10 access events
- Format: `ID: XXXXXX → PG: XXX → shard-name`
- Most recent access highlighted in yellow

### Map Info

- Displays current template name
- Shows PG count, replica count, and number of shards

## How It Works

The CLI generates random IDs continuously and uses the CRUSH algorithm to determine:

1. Which placement group (PG) the ID maps to
2. Which shard(s) should store the data

This helps visualize:

- How evenly data distributes across shards
- The effect of different weight configurations
- The impact of PG count on distribution patterns

## Understanding the Results

- **Even Distribution**: All shards should show similar percentages (±5%)
- **Weighted Distribution**: Shards with higher weights receive proportionally more data
- **Convergence**: Distribution percentages stabilize as more accesses accumulate

The visualization helps understand how CrushMap configurations affect data placement in distributed storage systems.
