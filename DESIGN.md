## 🏗 System Architecture
The system operates on a **Decoupled State-Driven Model**, ensuring high-fidelity simulation and optimized compute cycles.



[Image of modern software architecture diagram]


## 🧠 AI Intelligence Layer
We implement a **Multi-Tiered Decision Tree** combined with **Steering Behaviors**:
* **Perception:** Spatial awareness via grid-based hot-zones.
* **Cognition:** Tactical weighting ($W_t$) to balance aggression vs. positioning.
* **Actuation:** Smooth coordinate interpolation using Arrive & Separation algorithms.

## 📊 Data Flow & State Management
* **Immutable State:** Using a single source of truth for simulation frames.
* **Telemetry:** Hook-based monitoring for real-time AI debugging.