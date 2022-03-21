set -e
docker build -t containers.sv.nederlove.com/tradfri-mqtt .
docker push containers.sv.nederlove.com/tradfri-mqtt
kubectl delete pod -n mosquitto -l app.kubernetes.io/name=tradfri-mqtt