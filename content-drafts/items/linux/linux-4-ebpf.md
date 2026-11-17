---
schema: assessment-item/1
slug: linux-4-ebpf
skills: [linux]
level: 4
format: mcq
prompt: "What are eBPF tools, such as bpftrace, used for in production?"
options:
  - "Replacing the kernel without rebooting"
  - "Tracing kernel and application events safely, with little overhead"
  - "Compiling programs faster"
  - "Encrypting network traffic"
answer: 1
explanation: "eBPF runs verified programs in the kernel, so you can observe a live system without changing it."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
