"""
sim_lab.py — UTF Arena Simulation Analysis Lab
================================================
Loads the player CSV exported from SimUI and exposes analysis functions.

Usage:
    python sim_lab.py                       # interactive menu
    python sim_lab.py path/to/sim_players.csv

Requirements:
    pip install pandas matplotlib seaborn tabulate
"""

import sys
import ast
import pathlib
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

# ─── Load ─────────────────────────────────────────────────────────────────────

def load(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)

    # Parse semicolon-delimited list columns
    for col in ['items', 'teammates_classes', 'opponents_classes',
                'teammates_roles', 'opponents_roles']:
        if col in df.columns:
            df[col] = df[col].fillna('').apply(lambda x: x.split(';') if x else [])

    # Parse itemCounts dict column  (e.g. "basic_ad:2;basic_hp:1")
    if 'itemCounts' in df.columns:
        def _parse_ic(x):
            if not isinstance(x, str) or not x:
                return {}
            parts = x.split(';')
            out = {}
            for p in parts:
                if ':' in p:
                    k, v = p.rsplit(':', 1)
                    try:
                        out[k] = int(v)
                    except ValueError:
                        pass
            return out
        df['itemCounts'] = df['itemCounts'].apply(_parse_ic)

    # team_stratTime dict column  (e.g. "TOWER_FIRST:120;KILL_FIRST:45")
    if 'team_stratTime' in df.columns:
        df['team_stratTime'] = df['team_stratTime'].apply(
            lambda x: dict(
                (p.rsplit(':', 1)[0], int(p.rsplit(':', 1)[1]))
                for p in str(x).split(';') if ':' in p
            ) if isinstance(x, str) and x else {}
        )

    df['won'] = (df['team'] == df['winner']).astype(int)
    return df


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _print(df, title=''):
    if title:
        print(f'\n{"─"*60}\n{title}\n{"─"*60}')
    if HAS_TABULATE:
        print(tabulate(df, headers='keys', tablefmt='rounded_outline', floatfmt='.2f', showindex=False))
    else:
        print(df.to_string(index=False))


def _savefig(name: str):
    p = pathlib.Path(name)
    plt.savefig(p, bbox_inches='tight', dpi=150)
    print(f'  → saved {p}')


# ─── 1. Win rate by class ──────────────────────────────────────────────────────

def winrate_by_class(df: pd.DataFrame, min_games: int = 10, plot: bool = True):
    g = df.groupby('className').agg(
        games=('won', 'count'),
        wins=('won', 'sum'),
        winRate=('won', 'mean'),
        avgKDA=('kda', 'mean'),
        avgDPS=('dpsToHeroes', 'mean'),
        avgGold=('totalGold', 'mean'),
        avgPCS=('pcs', 'mean'),
    ).reset_index()
    g['winRate'] = (g['winRate'] * 100).round(1)
    g = g[g['games'] >= min_games].sort_values('winRate', ascending=False)
    _print(g, 'Win Rate by Class')

    if plot:
        fig, ax = plt.subplots(figsize=(max(10, len(g) * 0.7), 5))
        colors = ['#2ecc71' if w >= 52 else '#e74c3c' if w < 48 else '#95a5a6' for w in g['winRate']]
        ax.bar(g['className'], g['winRate'], color=colors)
        ax.axhline(50, color='white', linestyle='--', linewidth=1, alpha=0.5)
        ax.set_title('Win Rate by Class')
        ax.set_ylabel('Win Rate %')
        ax.set_xlabel('')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        _savefig('plot_winrate_class.png')
        plt.show()
    return g


# ─── 2. DPS / KDA / Gold distributions ───────────────────────────────────────

def stat_distributions(df: pd.DataFrame, classes: list = None):
    sub = df[df['className'].isin(classes)] if classes else df
    stats = ['dpsToHeroes', 'kda', 'totalGold', 'pcs', 'killParticipation', 'dmgPerGold']
    available = [s for s in stats if s in sub.columns]

    ncols = 3
    nrows = (len(available) + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(14, nrows * 3.5))
    axes = axes.flatten() if nrows > 1 else axes

    for i, col in enumerate(available):
        ax = axes[i]
        ax.hist(sub[col].dropna(), bins=40, color='#3498db', edgecolor='none', alpha=0.85)
        ax.set_title(col)
        ax.set_ylabel('count')
    for j in range(len(available), len(axes)):
        axes[j].set_visible(False)

    plt.suptitle('Stat Distributions' + (f' — {", ".join(classes)}' if classes else ''), y=1.01)
    plt.tight_layout()
    _savefig('plot_stat_distributions.png')
    plt.show()


# ─── 3. Best team compositions (by win rate) ──────────────────────────────────

def best_team_comps(df: pd.DataFrame, min_games: int = 5, top_n: int = 20):
    rows = []
    for _, row in df.iterrows():
        comp = sorted([row['className']] + list(row.get('teammates_classes', [])))
        rows.append({'comp': '|'.join(comp), 'won': row['won'], 'gameMode': row.get('gameMode', '')})

    cdf = pd.DataFrame(rows)
    g = cdf.groupby('comp').agg(
        games=('won', 'count'),
        wins=('won', 'sum'),
        winRate=('won', 'mean'),
    ).reset_index()
    g['winRate'] = (g['winRate'] * 100).round(1)
    g = g[g['games'] >= min_games].sort_values('winRate', ascending=False).head(top_n)
    _print(g, f'Top {top_n} Team Compositions (min {min_games} games)')
    return g


# ─── 4. Item impact on win rate ───────────────────────────────────────────────

def item_impact(df: pd.DataFrame, min_appearances: int = 20):
    rows = []
    for _, row in df.iterrows():
        for item in set(row.get('items', [])):
            if item:
                rows.append({'item': item, 'won': row['won']})
    idf = pd.DataFrame(rows)
    g = idf.groupby('item').agg(
        appearances=('won', 'count'),
        wins=('won', 'sum'),
        winRate=('won', 'mean'),
    ).reset_index()
    g['winRate'] = (g['winRate'] * 100).round(1)
    g = g[g['appearances'] >= min_appearances].sort_values('winRate', ascending=False)
    _print(g, 'Item Impact on Win Rate')

    if len(g) > 0:
        fig, ax = plt.subplots(figsize=(max(10, len(g) * 0.7), 5))
        colors = ['#2ecc71' if w >= 52 else '#e74c3c' if w < 48 else '#95a5a6' for w in g['winRate']]
        ax.bar(g['item'], g['winRate'], color=colors)
        ax.axhline(50, color='white', linestyle='--', linewidth=1, alpha=0.5)
        ax.set_title('Item Win Rate')
        ax.set_ylabel('Win Rate %')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        _savefig('plot_item_winrate.png')
        plt.show()
    return g


# ─── 5. Strategy win rates (Dominion modes) ───────────────────────────────────

def strategy_winrates(df: pd.DataFrame, min_games: int = 5, plot: bool = True):
    if 'team_dominantStrategy' not in df.columns:
        print('No strategy data in this CSV.')
        return None

    sub = df[df['team_dominantStrategy'].notna() & (df['team_dominantStrategy'] != '')]
    if sub.empty:
        print('No strategy data found (arena/aram games have no macro strategy).')
        return None

    g = sub.groupby('team_dominantStrategy').agg(
        games=('won', 'count'),
        wins=('won', 'sum'),
        winRate=('won', 'mean'),
        avgExploit=('team_exploitTimeFrac', 'mean'),
        avgExplore=('team_exploreTimeFrac', 'mean'),
        avgStratCount=('team_strategyCount', 'mean'),
    ).reset_index()
    g['winRate'] = (g['winRate'] * 100).round(1)
    g = g[g['games'] >= min_games].sort_values('winRate', ascending=False)
    _print(g, 'Strategy Win Rates (dominant strategy per team)')

    if plot and len(g) > 0:
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))

        colors = ['#2ecc71' if w >= 52 else '#e74c3c' if w < 48 else '#95a5a6' for w in g['winRate']]
        axes[0].bar(g['team_dominantStrategy'], g['winRate'], color=colors)
        axes[0].axhline(50, color='white', linestyle='--', linewidth=1, alpha=0.5)
        axes[0].set_title('Win Rate by Dominant Strategy')
        axes[0].set_ylabel('Win Rate %')
        plt.setp(axes[0].get_xticklabels(), rotation=30, ha='right')

        x = np.arange(len(g))
        w = 0.35
        axes[1].bar(x - w/2, g['avgExploit'], w, label='Exploit time frac', color='#e67e22')
        axes[1].bar(x + w/2, g['avgExplore'], w, label='Explore time frac', color='#3498db')
        axes[1].set_xticks(x)
        axes[1].set_xticklabels(g['team_dominantStrategy'], rotation=30, ha='right')
        axes[1].set_title('Avg Phase Time Fraction per Strategy')
        axes[1].legend()

        plt.tight_layout()
        _savefig('plot_strategy_winrates.png')
        plt.show()
    return g


# ─── 6. Strategy timeline breakdown (stacked bar) ─────────────────────────────

def strategy_time_breakdown(df: pd.DataFrame):
    if 'team_stratTime' not in df.columns:
        print('No stratTime data.')
        return

    all_strats = set()
    for st in df['team_stratTime']:
        all_strats.update(st.keys())
    all_strats = sorted(all_strats)

    rows = []
    for strat in all_strats:
        won_times   = df[df['won'] == 1]['team_stratTime'].apply(lambda x: x.get(strat, 0))
        lost_times  = df[df['won'] == 0]['team_stratTime'].apply(lambda x: x.get(strat, 0))
        rows.append({
            'strategy': strat,
            'avg_time_winners': won_times.mean(),
            'avg_time_losers':  lost_times.mean(),
        })

    bdf = pd.DataFrame(rows).sort_values('avg_time_winners', ascending=False)
    _print(bdf, 'Avg Time per Strategy — Winners vs Losers')

    if len(bdf) > 0:
        x = np.arange(len(bdf))
        w = 0.35
        fig, ax = plt.subplots(figsize=(max(10, len(bdf)*0.9), 5))
        ax.bar(x - w/2, bdf['avg_time_winners'], w, label='Winners', color='#2ecc71')
        ax.bar(x + w/2, bdf['avg_time_losers'],  w, label='Losers',  color='#e74c3c')
        ax.set_xticks(x)
        ax.set_xticklabels(bdf['strategy'], rotation=30, ha='right')
        ax.set_title('Avg Time per Strategy — Winners vs Losers')
        ax.set_ylabel('Seconds')
        ax.legend()
        plt.tight_layout()
        _savefig('plot_strategy_time.png')
        plt.show()


# ─── 7. KDA distributions by role ────────────────────────────────────────────

def kda_by_role(df: pd.DataFrame, plot: bool = True):
    if 'role' not in df.columns:
        print('No role column.')
        return
    g = df.groupby('role').agg(
        games=('kda', 'count'),
        avgKDA=('kda', 'mean'),
        medKDA=('kda', 'median'),
        avgDPS=('dpsToHeroes', 'mean'),
        avgHPS=('hpsHealed', 'mean'),
        avgPCS=('pcs', 'mean'),
        winRate=('won', 'mean'),
    ).reset_index()
    g['winRate'] = (g['winRate'] * 100).round(1)
    _print(g.sort_values('winRate', ascending=False), 'Stats by Role')

    if plot:
        roles = g['role'].tolist()
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        for ax, metric in zip(axes, ['avgKDA', 'avgDPS', 'winRate']):
            vals = g.set_index('role')[metric]
            ax.bar(roles, vals, color='#9b59b6')
            ax.set_title(metric)
            ax.set_ylabel(metric)
            plt.setp(ax.get_xticklabels(), rotation=30, ha='right')
        plt.tight_layout()
        _savefig('plot_kda_role.png')
        plt.show()
    return g


# ─── 8. Game mode summary ─────────────────────────────────────────────────────

def gamemode_summary(df: pd.DataFrame):
    if 'gameMode' not in df.columns:
        print('No gameMode column.')
        return
    g = df.groupby('gameMode').agg(
        games=('won', 'count'),
        avgDuration=('gameDuration', 'mean'),
        avgKills=('kills', 'mean'),
        avgDmg=('dmgDealtToHeroes', 'mean'),
        avgGold=('totalGold', 'mean'),
    ).reset_index()
    g['avgDuration'] = g['avgDuration'].round(0).astype(int)
    _print(g, 'Summary by Game Mode')
    return g


# ─── 9. Full report (all analyses) ───────────────────────────────────────────

def full_report(df: pd.DataFrame):
    winrate_by_class(df, plot=False)
    best_team_comps(df)
    item_impact(df, plot=False)
    strategy_winrates(df, plot=False)
    kda_by_role(df, plot=False)
    gamemode_summary(df)


# ─── Interactive menu ─────────────────────────────────────────────────────────

MENU = """\
╔══════════════════════════════════════════╗
║         UTF Arena — Sim Lab              ║
╠══════════════════════════════════════════╣
║  1  Win rate by class  (+ bar chart)     ║
║  2  Stat distributions                   ║
║  3  Best team compositions               ║
║  4  Item impact on win rate              ║
║  5  Strategy win rates                   ║
║  6  Strategy time breakdown              ║
║  7  KDA / stats by role                  ║
║  8  Game mode summary                    ║
║  9  Full text report (no plots)          ║
║  0  Quit                                 ║
╚══════════════════════════════════════════╝"""


def _menu(df: pd.DataFrame):
    print(f'\nLoaded {len(df):,} player-game rows  |  {df["gameIndex"].nunique():,} games')
    print(f'Classes: {sorted(df["className"].unique())}')
    print(f'Modes:   {sorted(df["gameMode"].unique()) if "gameMode" in df.columns else "n/a"}')

    while True:
        print(MENU)
        choice = input('Choice: ').strip()
        if choice == '0':
            break
        elif choice == '1':
            winrate_by_class(df)
        elif choice == '2':
            cls_input = input('Classes (comma-sep, blank=all): ').strip()
            classes = [c.strip() for c in cls_input.split(',')] if cls_input else None
            stat_distributions(df, classes)
        elif choice == '3':
            n = int(input('Min games per comp [5]: ').strip() or 5)
            best_team_comps(df, min_games=n)
        elif choice == '4':
            item_impact(df)
        elif choice == '5':
            strategy_winrates(df)
        elif choice == '6':
            strategy_time_breakdown(df)
        elif choice == '7':
            kda_by_role(df)
        elif choice == '8':
            gamemode_summary(df)
        elif choice == '9':
            full_report(df)
        else:
            print('Unknown option.')


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if len(sys.argv) < 2:
        # Try to find the most recently modified CSV in the current directory
        csvs = sorted(pathlib.Path('.').glob('sim_players_*.csv'), key=lambda p: p.stat().st_mtime, reverse=True)
        if not csvs:
            print('Usage: python sim_lab.py <sim_players_*.csv>')
            sys.exit(1)
        path = csvs[0]
        print(f'Auto-detected CSV: {path}')
    else:
        path = sys.argv[1]

    df = load(str(path))
    _menu(df)
