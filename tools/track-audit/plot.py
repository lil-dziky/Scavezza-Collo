import json,sys
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
A=json.load(open(sys.argv[1]));i=int(sys.argv[2]);a=A[i]
P=a['pts'];xs=[p[0] for p in P];ys=[p[1] for p in P]
fig,ax=plt.subplots(figsize=(11,8))
ax.plot(xs+[xs[0]],ys+[ys[0]],color='#555',lw=2)
N=a['N'];sm=a['lenM']/len(P)
# corners
import math
for n,c in enumerate(a['corners']):
    k=min(len(P)-1,int(c['mid']/ (a['lenM']/len(P))))
    x,y=P[k]
    col='#d62828' if c['rmin']<30 else '#e08a00' if c['rmin']<70 else '#2a8a3a'
    ax.plot([x],[y],'o',color=col,ms=7)
    ax.annotate(f"{n+1}{c['dir']} {c['rmin']}m",(x,y),textcoords='offset points',xytext=(4,4),fontsize=7)
ax.plot([xs[0]],[ys[0]],'s',color='k',ms=9);ax.annotate('S/F',(xs[0],ys[0]),fontsize=9,fontweight='bold')
ax.set_aspect('equal');ax.invert_yaxis();ax.set_title(f"{a['name']} {a['lenM']} m - {len(a['corners'])} corners (red<30m, orange<70m)")
fig.savefig(sys.argv[3],dpi=80,bbox_inches='tight')
